import * as React from 'react';
import { RoomClient } from './RoomClient';

interface RoomPageProps {
  params: Promise<{ token_id: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { token_id } = await params;
  const decodedTokenId = decodeURIComponent(token_id);

  return <RoomClient tokenId={decodedTokenId} />;
}
