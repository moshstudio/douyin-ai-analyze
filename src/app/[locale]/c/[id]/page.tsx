import ChatContainer from "@/components/ChatContainer";

interface PageProps {
  params: Promise<{
    id: string;
    locale: string;
  }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { id } = await params;
  return <ChatContainer conversationId={id} />;
}
