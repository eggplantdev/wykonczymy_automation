import { cn } from '@/lib/utils/cn'

type PropsT = {
  variant?: 'black' | 'white'
}

export const Spinner = ({ variant = 'black' }: PropsT) => {
  return (
    <div role="status" className={'content-center'}>
      <div
        className={cn(
          'inline-block aspect-square w-10 animate-spin rounded-full border-4 border-solid',
          variant === 'black' ? 'border-black' : 'border-white',
          'border-r-transparent',
        )}
        role="status"
      ></div>
    </div>
  )
}
