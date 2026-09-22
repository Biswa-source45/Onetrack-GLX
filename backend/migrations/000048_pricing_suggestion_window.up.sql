-- Sliding-window size (number of past approved deals to average) for the
-- Pricing Request "suggested price/margin" hint — see PricingSuggestion.
INSERT INTO auth.system_configurations (key, value, description)
VALUES (
    'pricing_suggestion_window',
    '5'::jsonb,
    'Number of past approved deals to average for the Pricing Request suggested unit price / margin hint'
)
ON CONFLICT (key) DO NOTHING;
