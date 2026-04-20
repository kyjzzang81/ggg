import { useEffect, useState, type ComponentType } from 'react'
import LottieModule from 'lottie-react'

type PreloaderProps = {
  message?: string
  className?: string
  overlay?: boolean
}

let cachedAnimationData: object | null = null
type LottieProps = { animationData: object; loop?: boolean; autoplay?: boolean; className?: string }
const LottieCandidate =
  (LottieModule as unknown as { default?: ComponentType<LottieProps> }).default ??
  (LottieModule as unknown as ComponentType<LottieProps>)
const Lottie = typeof LottieCandidate === 'function' ? LottieCandidate : null

export function Preloader({ message = 'ggg가 데이터 가져오고 있어요', className, overlay = true }: PreloaderProps) {
  const [animationData, setAnimationData] = useState<object | null>(cachedAnimationData)

  useEffect(() => {
    let alive = true

    if (!cachedAnimationData) {
      fetch('/loading.json')
        .then((res) => res.json())
        .then((json) => {
          cachedAnimationData = json
          if (alive) setAnimationData(json)
        })
        .catch(() => {
          // fallback UI만 사용
        })
    }

    return () => {
      alive = false
    }
  }, [])

  return (
    <div
      className={[overlay ? 'preloader-overlay' : 'preloader-inline', className].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
    >
      <div className="preloader-card">
        <div className="preloader-anim-wrap">
          {animationData && Lottie ? (
            <Lottie animationData={animationData} loop autoplay className="preloader-anim" />
          ) : (
            <span className="preloader-fallback" aria-hidden />
          )}
        </div>
        <p className="preloader-text">{message}</p>
      </div>
    </div>
  )
}
