import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lightbulb, AlertTriangle, CheckCircle, FileWarning, Heart, ThumbsUp, Sparkles, ChevronRight } from 'lucide-react';
import { ContextualTip as TipType } from '@/types/clearcontract-intake';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const iconMap = {
  info: Lightbulb,
  warning: AlertTriangle,
  success: CheckCircle,
  permit: FileWarning,
};

const colorMap = {
  info: 'bg-primary/10 text-primary border-primary/20',
  warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  permit: 'bg-destructive/10 text-destructive border-destructive/20',
};

const iconBgMap = {
  info: 'bg-primary/15 text-primary',
  warning: 'bg-amber-500/15 text-amber-600',
  success: 'bg-emerald-500/15 text-emerald-600',
  permit: 'bg-destructive/15 text-destructive',
};

type Reaction = 'love' | 'helpful' | 'wow';

interface ContextualTipCardProps {
  tip: TipType;
  onDismiss: () => void;
  onReact: (tipId: string, reaction: Reaction) => void;
  reaction?: Reaction | null;
}

function ContextualTipCard({ tip, onDismiss, onReact, reaction }: ContextualTipCardProps) {
  const Icon = iconMap[tip.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={cn('rounded-lg border p-3.5', colorMap[tip.type])}>
        <div className="flex items-start gap-2.5">
          <div className={cn('p-1.5 rounded-md shrink-0', iconBgMap[tip.type])}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-[13px] leading-tight text-foreground mb-1">{tip.title}</h4>
            <p className="text-[12px] leading-relaxed text-muted-foreground">{tip.message}</p>

            <div className="flex items-center gap-1 mt-2.5">
              {([
                { key: 'love' as Reaction, icon: Heart, label: '♥' },
                { key: 'helpful' as Reaction, icon: ThumbsUp, label: 'Helpful' },
                { key: 'wow' as Reaction, icon: Sparkles, label: 'Wow' },
              ]).map(r => (
                <button
                  key={r.key}
                  onClick={() => onReact(tip.id, r.key)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all duration-200',
                    'hover:scale-105 active:scale-95',
                    reaction === r.key
                      ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
                      : 'bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground'
                  )}
                >
                  <r.icon className={cn('w-3 h-3', reaction === r.key && r.key === 'love' && 'fill-primary')} />
                  {r.label}
                </button>
              ))}

              <div className="flex-1" />

              <button
                onClick={onDismiss}
                className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-background/60 transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TipsList({ tips, onDismiss, reactions, onReact }: {
  tips: TipType[];
  onDismiss: (id: string) => void;
  reactions: Record<string, Reaction>;
  onReact: (tipId: string, reaction: Reaction) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <AnimatePresence mode="popLayout">
        {tips.map(tip => (
          <ContextualTipCard
            key={tip.id}
            tip={tip}
            onDismiss={() => onDismiss(tip.id)}
            onReact={onReact}
            reaction={reactions[tip.id]}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface TipsContainerProps {
  tips: TipType[];
  onDismiss: (id: string) => void;
}

export function TipsContainer({ tips, onDismiss }: TipsContainerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleReact = (tipId: string, reaction: Reaction) => {
    setReactions(prev => ({
      ...prev,
      [tipId]: prev[tipId] === reaction ? undefined! : reaction,
    }));
  };

  if (tips.length === 0) return null;

  // Mobile: floating pill + bottom drawer
  if (isMobile) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-6 right-4 z-50"
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDrawerOpen(true)}
            className="rounded-full shadow-lg gap-1.5 bg-card border-border hover:shadow-xl transition-shadow"
          >
            <Lightbulb className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium">{tips.length} tip{tips.length !== 1 ? 's' : ''}</span>
          </Button>
        </motion.div>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="max-h-[60vh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="flex items-center gap-2 text-sm">
                <Lightbulb className="w-4 h-4 text-primary" />
                Haleo's Tips
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-medium ml-1">
                  {tips.length}
                </span>
              </DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="px-4 pb-4 flex-1 overflow-auto">
              <TipsList tips={tips} onDismiss={onDismiss} reactions={reactions} onReact={handleReact} />
            </ScrollArea>
            <div className="px-4 py-2.5 border-t border-border">
              <p className="text-[10px] text-muted-foreground/70 text-center leading-tight">
                Tips update as you progress through your project
              </p>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: right-edge sidebar or collapsed pill
  return (
    <AnimatePresence mode="wait">
      {collapsed ? (
        <motion.div
          key="collapsed"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed bottom-6 right-4 z-50"
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCollapsed(false)}
            className="rounded-full shadow-lg gap-1.5 bg-card border-border hover:shadow-xl transition-shadow"
          >
            <Lightbulb className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium">{tips.length} tip{tips.length !== 1 ? 's' : ''}</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground rotate-180" />
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="expanded"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-14 right-0 bottom-0 z-40 w-[280px] border-l border-border bg-card/95 backdrop-blur-sm flex flex-col"
        >
          <div className="px-3.5 py-3 border-b border-border flex items-center gap-2">
            <div className="p-1 rounded-md bg-primary/10">
              <Lightbulb className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-foreground flex-1">Haleo's Tips</span>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-medium">
              {tips.length}
            </span>
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Collapse tips"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3">
              <TipsList tips={tips} onDismiss={onDismiss} reactions={reactions} onReact={handleReact} />
            </div>
          </ScrollArea>

          <div className="px-3.5 py-2.5 border-t border-border">
            <p className="text-[10px] text-muted-foreground/70 text-center leading-tight">
              Tips update as you progress through your project
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
