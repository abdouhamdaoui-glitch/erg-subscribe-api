export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: "Valid email required" });
  }

 const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ACCESS_TOKEN;

  try {
    // Check if customer already exists
    const searchRes = await fetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(email)}&fields=id,email`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_TOKEN,
          "Content-Type": "application/json",
        }
      }
    );
    const searchData = await searchRes.json();
    const existing = searchData.customers?.[0];

    if (existing) {
      // Already exists — update consent
      await fetch(
        `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/customers/${existing.id}.json`,
        {
          method: "PUT",
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer: {
              id: existing.id,
              email_marketing_consent: { state: "subscribed", opt_in_level: "single_opt_in" },
              tags: "newsletter, popup-signup"
            }
          })
        }
      );
      return res.status(200).json({ success: true, status: "updated" });
    }

    // Create new customer
    const createRes = await fetch(
      `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/customers.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: {
            email,
            accepts_marketing: true,
            email_marketing_consent: { state: "subscribed", opt_in_level: "single_opt_in" },
            tags: "newsletter, popup-signup",
            send_email_welcome: false
          }
        })
      }
    );

    const createData = await createRes.json();

    if (createData.errors) {
      return res.status(400).json({ success: false, error: createData.errors });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Subscribe error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
}
