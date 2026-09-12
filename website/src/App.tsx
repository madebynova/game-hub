import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './components/Layout'
import Home from './pages/Home'

/* Home ships in the main bundle; everything else is split off the route. */
const Games = lazy(() => import('./pages/Games'))
const GameDetails = lazy(() => import('./pages/GameDetails'))
const Updates = lazy(() => import('./pages/Updates'))
const NotFound = lazy(() => import('./pages/NotFound'))

/** Holds layout height while a route chunk loads, so nothing jumps. */
function RouteFallback() {
  return <div style={{ minHeight: '60dvh' }} aria-busy="true" />
}

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/games', element: lazyRoute(<Games />) },
      { path: '/games/:slug', element: lazyRoute(<GameDetails />) },
      { path: '/updates', element: lazyRoute(<Updates />) },
      { path: '*', element: lazyRoute(<NotFound />) },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
