import { useRoute } from './router'
import { Story } from './pages/Story'
import { Explorer } from './pages/Explorer'

export default function App() {
  const route = useRoute()
  return route === 'explore' ? <Explorer /> : <Story />
}
