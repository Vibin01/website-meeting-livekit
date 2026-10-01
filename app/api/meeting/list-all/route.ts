import { NextResponse } from 'next/server';
import { getAllMeetings } from '@/app/actions/auth';

export async function GET() {
  try {
    const result = await getAllMeetings();

    if (!result.success) {
      return NextResponse.json(
        {
          status: 'fail',
          message:
            result.message ||
            'Unauthorized or failed to fetch meetings',
        },
        {
          status: result.message
            ?.toLowerCase()
            .includes('unauthorized')
            ? 401
            : 500,
        }
      );
    }

    return NextResponse.json({
      status: 'success',
      data: result.data || [],
    });
  } catch (error) {
    console.error('list-all route error:', error);

    return NextResponse.json(
      {
        status: 'fail',
        message: 'Failed to fetch meetings',
      },
      { status: 500 }
    );
  }
}