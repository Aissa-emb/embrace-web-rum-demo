// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import { useRouter } from 'next/router';
import { useCallback } from 'react';
import CartItems from '../CartItems';
import CheckoutForm from '../CheckoutForm';
import { IFormData } from '../CheckoutForm/CheckoutForm';
import SessionGateway from '../../gateways/Session.gateway';
import { useCart } from '../../providers/Cart.provider';
import { useCurrency } from '../../providers/Currency.provider';
import * as S from '../../styles/Cart.styled';
import { addBreadcrumb, logError, startEmbraceSpan, endEmbraceSpan } from '../../utils/embrace';
import { shouldTrigger, delay } from '../../utils/issueTriggers';
import { maybeCaptureCheckoutValidationError } from '../../utils/controlledIssues';

const { userId } = SessionGateway.getSession();

const CartDetail = () => {
  const {
    cart: { items },
    emptyCart,
    placeOrder,
  } = useCart();
  const { selectedCurrency } = useCurrency();
  const { push } = useRouter();

  const onPlaceOrder = useCallback(
    async ({
      email,
      state,
      streetAddress,
      country,
      city,
      zipCode,
      creditCardCvv,
      creditCardExpirationMonth,
      creditCardExpirationYear,
      creditCardNumber,
    }: IFormData) => {
      addBreadcrumb('checkout_started');
      startEmbraceSpan('checkout_flow');

      // Controlled issue: checkout_validation_error
      // Captures a realistic validation schema error through Embrace.
      // Checkout proceeds with native HTML validation as the fallback path.
      maybeCaptureCheckoutValidationError({
        page: '/cart',
        formFields: { streetAddress, city, state, country, zipCode },
      });

      try {
        // Issue trigger: slow_checkout — add artificial 5s delay
        if (shouldTrigger('slow_checkout')) {
          await delay(5000);
        }

        // Issue trigger: checkout_500 — simulate server failure
        if (shouldTrigger('checkout_500')) {
          throw new Error('Simulated checkout 500 error [Embrace demo trigger]');
        }

        const order = await placeOrder({
          userId,
          email,
          address: {
            streetAddress,
            state,
            country,
            city,
            zipCode,
          },
          userCurrency: selectedCurrency,
          creditCard: {
            creditCardCvv,
            creditCardExpirationMonth,
            creditCardExpirationYear,
            creditCardNumber,
          },
        });

        addBreadcrumb('payment_submitted');
        endEmbraceSpan('checkout_flow', true);

        push({
          pathname: `/cart/checkout/${order.orderId}`,
          query: { order: JSON.stringify(order) },
        });
      } catch (err) {
        addBreadcrumb('checkout_failed');
        logError('checkout_failed', {
          error: String(err),
          userId,
          itemCount: items.length,
        });
        endEmbraceSpan('checkout_flow', false);
      }
    },
    [placeOrder, push, selectedCurrency, items.length]
  );

  return (
    <S.Container>
      <div>
        <S.Header>
          <S.CarTitle>Shopping Cart</S.CarTitle>
          <S.EmptyCartButton onClick={emptyCart} $type="link">
            Empty Cart
          </S.EmptyCartButton>
        </S.Header>
        <CartItems productList={items} />
      </div>
      <CheckoutForm onSubmit={onPlaceOrder} />
    </S.Container>
  );
};

export default CartDetail;
