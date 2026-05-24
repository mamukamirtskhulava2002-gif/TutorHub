import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const { tutorId, tutorName, price, studentName, date } = await request.json();

    // ვქმნით Stripe-ის გადახდის სესიას
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gel', // გადახდა ლარებში
            product_data: {
              name: `გაკვეთილი მასწავლებელთან: ${tutorName}`,
              description: `სტუდენტი: ${studentName}, თარიღი: ${date}`,
            },
            unit_amount: price * 100, // Stripe თეთრებში ითვლის (მაგ. 30 ლარი = 3000 თეთრი)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // გადახდის შემდეგ საით გადამისამართდეს მომხმარებელი (ლოკალურად ან ვერსელზე)
      success_url: `${request.headers.get('origin')}/dashboard?success=true`,
      cancel_url: `${request.headers.get('origin')}/booking?canceled=true`,
      metadata: {
        tutorId,
        studentName,
        bookingDate: date,
      },
    });

    return NextResponse.json({ id: session.url }); // ვაბრუნებთ გადახდის ლინკს
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}