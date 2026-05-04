// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import { CypressFields } from '../../utils/enums/CypressFields';
import { useAd } from '../../providers/Ad.provider';
import ProductCard from '../ProductCard';
import * as S from './Recommendations.styled';
import { logWarning } from '../../utils/embrace';
import { shouldTrigger } from '../../utils/issueTriggers';
import { maybeCaptureProductRecommendationError } from '../../utils/controlledIssues';

const Recommendations = () => {
  const { recommendedProductList } = useAd();

  // Legacy issue trigger (kept for backward compatibility)
  if (shouldTrigger('recommendation_failure')) {
    logWarning('recommendation_load_failed', {
      reason: 'simulated_recommendation_failure',
      trigger: 'recommendation_failure',
    });
    return null;
  }

  // Controlled issue: product_recommendation_error
  // Captures a realistic TypeError through Embrace without crashing the app.
  // When active, recommendations silently fail and the section is hidden.
  if (maybeCaptureProductRecommendationError({
    page: typeof window !== 'undefined' ? window.location.pathname : '/product/[productId]',
  })) {
    return null;
  }

  if (!recommendedProductList || recommendedProductList.length === 0) {
    return null;
  }

  return (
    <S.Recommendations data-cy={CypressFields.RecommendationList}>
      <S.TitleContainer>
        <S.Title>You May Also Like</S.Title>
      </S.TitleContainer>
      <S.ProductList>
        {recommendedProductList.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </S.ProductList>
    </S.Recommendations>
  );
};

export default Recommendations;
