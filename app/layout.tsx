import type { Metadata,Viewport } from 'next';
import './globals.css';
import {ENTRY_CSS,ENTRY_MARKUP,ENTRY_WATCHDOG} from '@/lib/site-entry-shell';
export const metadata: Metadata = {
    metadataBase: new URL("https://linjian-cottage.flowy-fern-2870.chatgpt.site"),
    openGraph: { title: '林间小筑', description: '采集 · 建造 · 冒险', images: [{ url: '/og.png', width: 1734, height: 907 }] },
    twitter: { card: 'summary_large_image', title: '林间小筑', description: '采集 · 建造 · 冒险', images: ['/og.png'] },
    title: '林间小筑 · 采集、建造与冒险',
    description: '从一片林间空地开始，采集木材、亲手搭建小屋，和朋友踏上冒险。',
};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({ children }: Readonly<{
    children: React.ReactNode;
}>) {
    return <html lang="zh-CN"><head><style dangerouslySetInnerHTML={{__html:ENTRY_CSS}}/></head><body><div id="site-bootstrap" dangerouslySetInnerHTML={{__html:ENTRY_MARKUP}}/><script dangerouslySetInnerHTML={{__html:ENTRY_WATCHDOG}}/>{children}</body></html>;
}
