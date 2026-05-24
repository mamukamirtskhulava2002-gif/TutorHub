import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ფუნქცია ბაზიდან ჯავშნების წამოსაღებად
export async function GET() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, tutors(name, subject)');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ფუნქცია ახალი ჯავშნის ჩასაწერად
export async function POST(request) {
  const { tutorId, studentName, date } = await request.json();

  const { data, error } = await supabase
    .from('bookings')
    .insert([{ tutor_id: tutorId, student_name: studentName, booking_date: date, status: 'pending' }])
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}