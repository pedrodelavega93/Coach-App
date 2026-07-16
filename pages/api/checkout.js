import Stripe from "stripe";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { clientId, email } = req.body;
  if (!clientId || !email) return res.status(400).json({ error: "Falta clientId o email" });

  try {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("client_id", clientId)
      .maybeSingle();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: sub?.stripe_customer_id ? undefined : email,
      customer: sub?.stripe_customer_id || undefined,
      line_items: [{ price: process.env.STRIPE_MONTHLY_PRICE_ID, quantity: 1 }],
      client_reference_id: clientId,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/client?pago=exitoso`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/client?pago=cancelado`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
