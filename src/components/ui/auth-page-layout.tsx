type AuthPageLayoutPropsT = {
  title: string
  description?: string
  children: React.ReactNode
}

export function AuthPageLayout({ title, description, children }: AuthPageLayoutPropsT) {
  return (
    <div className="w-full max-w-sm px-4">
      <h1
        className={`text-foreground text-center text-xl font-semibold ${description ? 'mb-2' : 'mb-6'}`}
      >
        {title}
      </h1>
      {description && (
        <p className="text-muted-foreground mb-6 text-center text-sm">{description}</p>
      )}
      {children}
    </div>
  )
}
