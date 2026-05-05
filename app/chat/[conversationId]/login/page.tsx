import { redirect } from 'next/navigation'

interface Props {
  params: { conversationId: string }
}

export default function ChatLoginPage({ params }: Props) {
  redirect(`/login?next=/chat/${params.conversationId}`)
}
