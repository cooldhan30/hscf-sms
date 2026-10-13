import { CreateGameWizard } from '@/components/grClassic/teacher/CreateGameWizard'
import { gameById } from '@/lib/grClassic/sampleData'

export default function GrClassicCreatePage({ searchParams }: { searchParams: { edit?: string } }) {
  const edit = searchParams.edit ? gameById(searchParams.edit) : undefined
  return <CreateGameWizard edit={edit} />
}
