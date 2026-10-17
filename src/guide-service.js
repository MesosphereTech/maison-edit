// Keep provider failures distinct from generated advice in every presentation.
export function guideFailure(warning, language = "en") {
  const zh = language === "zh";
  if (warning === "review_daily_limit")
    return zh
      ? "今日评审体验的 AI 请求额度已用完，请明天再试。浏览和选款仍可继续。"
      : "Today's review AI request allowance has been reached. Please try tomorrow; browsing and selecting pieces remain available.";
  if (warning === "review_busy")
    return zh
      ? "导购正在回复其他访客，请稍等片刻再试。"
      : "The guide is helping other visitors. Please try again in a moment.";
  if (warning === "provider_rate_limited" || warning === "rate_limited")
    return zh
      ? "AI 额度暂不可用或请求过于频繁，请稍后再试。"
      : "AI quota is unavailable or requests are too frequent. Please try again later.";
  if (warning === "no_catalog_matches")
    return zh
      ? "当前筛选没有合适的选款，可以调整品类或预算。"
      : "No pieces match these filters. Try another department or budget.";
  return zh
    ? "AI 暂时未能回复，请稍后重试。"
    : "AI could not reply just now. Please try again shortly.";
}

export function browsingPrompt(language = "en") {
  return language === "zh"
    ? "请像自然聊天的私人导购，围绕我正在看的这件商品说一小段具体的搭配想法。结合之前明确表达的喜好，避免重复之前的话；不要开场问好或复述问题，也不必列清单。只谈风格、配色与轮廓，不谈价格、库存、尺码或交易。"
    : "As a conversational personal stylist, offer a brief, specific styling thought about the piece I am looking at. Use preferences I have explicitly shared and avoid repeating earlier advice. Skip greetings, restating the question and lists. Discuss style, colour and silhouette only, without prices, stock, sizing or transactions.";
}
