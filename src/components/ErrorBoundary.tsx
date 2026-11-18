import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error al renderizar la galería:', error, info);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="flex h-full w-full items-center justify-center bg-[#0b0917] p-6 text-stone-100">
          <div className="max-w-md rounded-3xl border border-white/12 bg-[#141026] p-8 text-center shadow-2xl">
            <h1 className="font-display text-2xl font-semibold text-white mb-2">
              El Pasillo de los Recuerdos
            </h1>
            <p className="text-sm text-stone-300 mb-6">
              Ocurrió un problema inesperado al cargar la galería en este navegador.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 transition-colors"
            >
              Recargar página
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
