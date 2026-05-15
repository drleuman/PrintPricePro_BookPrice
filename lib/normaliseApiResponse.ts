import { BookPriceResponse, BookPriceOffer } from '../types';

const toNumber = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function normaliseApiResponse(data: any): BookPriceResponse {
  const rawOffers: any[] = Array.isArray(data?.offers)
    ? data.offers
    : Array.isArray(data?.print_houses)
      ? data.print_houses
      : Array.isArray(data)
        ? data
        : [];

  const recommendedOfferId =
    data?.recommended_offer_id ||
    data?.selected_offer_id ||
    null;

  const rawRecommendedOfferId =
    data?.raw_recommended_offer_id ||
    data?.selected_offer?.offer_id ||
    data?.selected_offer?.id ||
    null;

  const recommendedOfferIdStr = recommendedOfferId ? String(recommendedOfferId) : null;
  const rawRecommendedOfferIdStr = rawRecommendedOfferId ? String(rawRecommendedOfferId) : null;

  const normalisedOffers: BookPriceOffer[] = rawOffers.map((raw: any, index: number) => {
    const offerId = String(raw.id || raw.offer_id || `offer-${index}`);

    const rawOfferId = String(
      raw.offer_id ||
      raw.raw_offer?.offer_id ||
      raw.raw_offer?.id ||
      raw.id ||
      offerId
    );

    const currency = raw.currency || raw.currency_code || 'EUR';

    const totalCostRaw =
      raw.total_cost ??
      raw.cost ??
      raw.total_price ??
      raw.price ??
      raw.grand_total ??
      0;

    const totalCost = toNumber(totalCostRaw);

    const totalPriceRaw =
      raw.total_price ??
      raw.price ??
      raw.grand_total ??
      raw.total_cost ??
      totalCost;

    const totalPrice = toNumber(totalPriceRaw, totalCost);

    const margin = toNumber(raw.margin ?? 0);
    const marginPercent = toNumber(raw.margin_percent ?? raw.margin_pct ?? 0);

    const leadTimeDays = toNumber(
      raw.lead_time_days ??
      raw.production_days ??
      raw.days ??
      0
    );

    const estimatedDeliveryTime =
      raw.estimated_delivery_time ||
      raw.delivery_time ||
      raw.lead_time ||
      raw.eta ||
      (leadTimeDays ? `${leadTimeDays} working days` : '');

    const breakdown = Array.isArray(raw.lines)
      ? raw.lines.map((line: any) => ({
          label: String(line.item ?? line.label ?? ''),
          amount: toNumber(line.line_total ?? line.amount ?? 0),
        }))
      : Array.isArray(raw.breakdown)
        ? raw.breakdown.map((line: any) => ({
            label: String(line.label ?? line.item ?? ''),
            amount: toNumber(line.amount ?? line.line_total ?? 0),
          }))
        : [];

    const isRecommended =
      Boolean(raw.recommended) ||
      (recommendedOfferIdStr !== null && (recommendedOfferIdStr === offerId || recommendedOfferIdStr === rawOfferId)) ||
      (rawRecommendedOfferIdStr !== null && (rawRecommendedOfferIdStr === rawOfferId));

    return {
      id: offerId,
      offer_id: raw.offer_id || raw.raw_offer?.offer_id || raw.raw_offer?.id || raw.id,

      house_id: raw.house_id || raw.printer_id || raw.print_house_id,
      printer_id: raw.printer_id,
      print_house_id: raw.print_house_id,

      print_house:
        raw.print_house ||
        raw.print_house_name ||
        raw.name ||
        'Print house',

      total_cost: totalCost,
      total_price: totalPrice,
      margin,
      margin_percent: marginPercent,

      lead_time_days: leadTimeDays,
      estimated_delivery_time: estimatedDeliveryTime,

      breakdown,
      currency,

      recommended: isRecommended,
      source: raw.source || 'BPE_MARKETPLACE_NATIVE',
      status: raw.status,

      checkout_allowed: raw.checkout_allowed !== false,
      range: raw.range,
      message: raw.message,

      raw_offer: raw,
    };
  });

  return {
    success: !data?.error && normalisedOffers.length > 0,
    message: data?.message || data?.error || undefined,
    offers: normalisedOffers,
    recommended_offer_id: recommendedOfferId,
    raw_recommended_offer_id: rawRecommendedOfferId,
    raw_response: data,
  };
}
