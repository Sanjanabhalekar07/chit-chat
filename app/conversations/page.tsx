import ConversationsPage from "../components/conversations-page";
import PageFrame from "../components/page-frame";
import SessionGate from "../components/session-gate";

export default function ConversationListRoute() {
  return (
    <SessionGate>
      <PageFrame>
        <ConversationsPage />
      </PageFrame>
    </SessionGate>
  );
}
