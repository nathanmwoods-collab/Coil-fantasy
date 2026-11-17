import { TeamView } from '../../components/TeamView';
import { Screen } from '../../components/ui';
import { ME } from '../../demo/league';

export default function MyTeam() {
  return (
    <Screen>
      <TeamView teamId={ME} />
    </Screen>
  );
}
