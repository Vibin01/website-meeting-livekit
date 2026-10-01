import { ThemeProvider } from '@/components/app/theme-provider';
import { cn } from '@/lib/shadcn/utils';
import '@/styles/globals.css';



interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn(
        'scroll-smooth font-sans antialiased'
      )}
    >
      <head>
        <title>Connect EC Meeting</title>
        <meta name="description" content="Connect EC Meeting" />
      </head>
      <body className="overflow-x-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
