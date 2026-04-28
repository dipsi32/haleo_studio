import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Copy, ExternalLink, X, Check, Send, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InAppEmailComposerProps {
  contractorName: string;
  questions: string[];
  paymentSchedule?: string;
  onClose: () => void;
}

export function InAppEmailComposer({ contractorName, questions, paymentSchedule, onClose }: InAppEmailComposerProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(
    `Questions about your proposal — ${contractorName || 'Project'}`
  );

  const buildDefaultBody = () => {
    const allQuestions = [...questions];
    const ps = paymentSchedule?.toLowerCase();
    if (!ps || ps === 'not specified' || ps === 'n/a') {
      allQuestions.push(
        'Can we agree on a payment schedule tied to completed milestones — for example, 10% deposit, 30% at rough-in, 30% at drywall, and 30% at final walkthrough?'
      );
    }
    return `Hi ${contractorName || 'there'},\n\nI've been reviewing your proposal and had a few questions before moving forward:\n\n${allQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}\n\nLooking forward to hearing from you.\n\nBest regards`;
  };

  const [body, setBody] = useState(buildDefaultBody);
  const [copied, setCopied] = useState(false);

  const [sendStep, setSendStep] = useState<'compose' | 'confirm' | 'sent'>('compose');

  const handleCopy = async () => {
    const fullEmail = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    toast.success('Email copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    if (!to || !to.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (sendStep === 'compose') {
      setSendStep('confirm');
      return;
    }
    // Open in email client as the send mechanism
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank', 'noopener,noreferrer');
    setSendStep('sent');
    toast.success('Opening your email client — just hit Send!');
  };

  const handleOpenInClient = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="p-5 border-primary/20 bg-primary/[0.03] mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Draft Email to Contractor</h4>
              <p className="text-[11px] text-muted-foreground">Pre-filled with your questions — edit as needed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1">To</Label>
            <Input
              type="email"
              placeholder="contractor@email.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="text-sm h-9"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-sm h-9"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1">Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="text-sm min-h-[200px] leading-relaxed"
            />
          </div>

          {/* Confirmation banner */}
          {sendStep === 'confirm' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-primary/5 border border-primary/20 rounded-xl"
            >
              <p className="text-sm text-foreground font-medium mb-1">Ready to send?</p>
              <p className="text-xs text-muted-foreground mb-3">
                We'll open your email client with everything pre-filled. Just hit Send — nothing leaves without you pressing that button.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleSend} size="sm" className="gap-2 flex-1">
                  <Send className="w-3.5 h-3.5" />
                  Open & Send
                </Button>
                <Button onClick={() => setSendStep('compose')} variant="ghost" size="sm" className="text-muted-foreground">
                  Keep editing
                </Button>
              </div>
            </motion.div>
          )}

          {/* Sent confirmation */}
          {sendStep === 'sent' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-[hsl(var(--success-bg))] border border-[hsl(var(--success))]/20 rounded-xl text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <Check className="w-4 h-4 text-[hsl(var(--success))]" />
                <p className="text-sm font-medium text-foreground">Email opened in your client</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Hit Send in your email app to deliver it. You can always come back here to resend or edit.
              </p>
              <button onClick={() => setSendStep('compose')} className="text-xs text-primary underline mt-2">
                Edit & resend
              </button>
            </motion.div>
          )}

          {/* Action buttons */}
          {sendStep === 'compose' && (
            <div className="space-y-2 pt-1">
              <Button onClick={handleSend} className="w-full gap-2 text-sm h-10">
                <Send className="w-3.5 h-3.5" />
                Send to Contractor
              </Button>
              <div className="flex gap-2">
                <Button onClick={handleCopy} variant="ghost" size="sm" className="flex-1 gap-1.5 text-xs text-muted-foreground">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy text'}
                </Button>
                <Button onClick={handleOpenInClient} variant="ghost" size="sm" className="flex-1 gap-1.5 text-xs text-muted-foreground">
                  <ExternalLink className="w-3 h-3" />
                  Open in email app
                </Button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/60 text-center">
            Your email stays in-app for reference · We open your email client so you're always in control
          </p>
        </div>
      </Card>
    </motion.div>
  );
}
