import Stripe from "stripe";
import { buffer } from "micro";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const clientId = session.client_reference_id;
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        console.log("checkout.session.completed - clientId:", clientId);

        const { error } = await supabaseAdmin.from("subscriptions").upsert(
          {
            client_id: clientId,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            status: "active",
            current_period_end: periodEnd,
          },
          { onConflict: "client_id" }
        );

        if (error) {
          console.error("Error guardando subscription:", error);
          return res.status(500).json({ error: error.message });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({ status: "active", current_period_end: periodEnd })
          .eq("stripe_customer_id", invoice.customer);

        if (error) {
          console.error("Error actualizando subscription:", error);
          return res.status(500).json({ error: error.message });
        }
        break;
      }

      case "invoice.payment_failed":
      case "customer.subscription.deleted": {
        const obj = event.data.object;
        const customerId = obj.customer;
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_customer_id", customerId);
        break;
      }

      default:
        break;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Error general en webhook:", err);
    res.status(500).json({ error: err.message });
  }
}
