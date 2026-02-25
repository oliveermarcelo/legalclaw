import './globals.css';

export const metadata = {
  title: 'Dr. Lex — Assistente Jurídico com IA',
  description: 'Análise de contratos, gestão de prazos e monitoramento de diários oficiais com inteligência artificial.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
