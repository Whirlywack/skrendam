import { redirect } from 'next/navigation';

export default function MachineIndex() {
  redirect('/machine/scan-health');
}
