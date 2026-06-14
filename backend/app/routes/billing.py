from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
from ..database import get_db
from .. import models, schemas, auth
from ..services import stripe_service

router = APIRouter(prefix="/api/billing", tags=["Billing & Subscriptions"])

@router.get("/plans", response_model=List[schemas.PlanResponse])
def get_plans(db: Session = Depends(get_db)):
    return db.query(models.Plan).all()

@router.post("/checkout", response_model=schemas.OrderResponse)
def create_checkout(
    checkout_in: schemas.CheckoutSessionCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    plan = db.query(models.Plan).filter(models.Plan.id == checkout_in.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    discount = None
    discount_amount = 0.0
    final_amount = plan.price
    
    # 1. Handle FREETRIAL promo code (Bypasses Stripe checkout)
    if checkout_in.promo_code:
        discount = db.query(models.Discount).filter(
            models.Discount.code == checkout_in.promo_code.upper(),
            models.Discount.is_active == True
        ).first()
        
        if not discount:
            raise HTTPException(status_code=400, detail="Invalid or inactive promo code")
            
        # Check if user has already used this discount code
        used_order = db.query(models.Order).filter(
            models.Order.user_id == current_user.id,
            models.Order.discount_id == discount.id,
            models.Order.status == "completed"
        ).first()
        
        if used_order and discount.is_one_time:
            raise HTTPException(status_code=400, detail="Free trial code already used once by this user")
            
        discount_amount = (discount.percentage / 100.0) * plan.price
        final_amount = max(0.0, plan.price - discount_amount)
        
        # If final amount is 0, activate premium immediately and bypass Stripe checkout
        if final_amount == 0.0:
            order = models.Order(
                user_id=current_user.id,
                status="completed",
                total_amount=plan.price,
                discount_amount=discount_amount,
                final_amount=0.0,
                discount_id=discount.id,
                stripe_session_id="free_trial_bypass"
            )
            db.add(order)
            db.flush()
            
            order_item = models.OrderItem(
                order_id=order.id,
                plan_id=plan.id,
                quantity=1,
                price=plan.price
            )
            db.add(order_item)
            
            # Grant premium membership for 30 days
            current_user.is_premium = True
            current_user.premium_until = datetime.datetime.utcnow() + datetime.timedelta(days=30)
            
            db.commit()
            db.refresh(order)
            return order

    # 2. Regular Stripe checkout session creation
    # Create Stripe Customer if not exists
    if not current_user.stripe_customer_id:
        customer_id = stripe_service.create_stripe_customer(current_user.email, current_user.name)
        current_user.stripe_customer_id = customer_id
        db.commit()
        
    success_url = "http://localhost:5173/dashboard?payment=success"
    cancel_url = "http://localhost:5173/pricing?payment=cancelled"
    
    stripe_session = stripe_service.create_checkout_session(
        customer_id=current_user.stripe_customer_id,
        price_id=plan.stripe_price_id or "price_placeholder",
        success_url=success_url,
        cancel_url=cancel_url
    )
    
    # Create order in pending state
    order = models.Order(
        user_id=current_user.id,
        status="pending",
        total_amount=plan.price,
        discount_amount=0.0,
        final_amount=plan.price,
        stripe_session_id=stripe_session.get("id")
    )
    db.add(order)
    db.flush()
    
    order_item = models.OrderItem(
        order_id=order.id,
        plan_id=plan.id,
        quantity=1,
        price=plan.price
    )
    db.add(order_item)
    db.commit()
    db.refresh(order)
    
    # Attach session URL for front-end redirect
    order.stripe_session_id = stripe_session.get("url") # returning session url to client
    return order

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    
    event = stripe_service.verify_webhook_event(payload, sig_header)
    if not event:
        raise HTTPException(status_code=400, detail="Invalid signature")
        
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        session_id = session.get("id")
        
        # Find pending order
        order = db.query(models.Order).filter(
            models.Order.stripe_session_id == session_id,
            models.Order.status == "pending"
        ).first()
        
        if order:
            order.status = "completed"
            user = order.user
            user.is_premium = True
            # Extend premium for 30 days
            user.premium_until = datetime.datetime.utcnow() + datetime.timedelta(days=30)
            db.commit()
            
    return {"status": "success"}
