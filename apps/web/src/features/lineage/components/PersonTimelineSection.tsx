import React from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus } from 'lucide-react';
import type { PersonTimelineEvent } from '../utils/personTimeline';
import { PersonAvatarPortrait } from './PersonAvatarPortrait';

interface PersonTimelineSectionProps {
  events: PersonTimelineEvent[];
  expanded: boolean;
  onToggleExpand: () => void;
  onCreateEvent: () => void;
  onEditEvent: (event: PersonTimelineEvent) => void;
  onSelectPerson?: (personId: string) => void;
}

export const PersonTimelineSection: React.FC<PersonTimelineSectionProps> = ({
  events,
  expanded,
  onToggleExpand,
  onCreateEvent,
  onEditEvent,
  onSelectPerson,
}) => {
  return (
    <section className="px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 text-left py-1 rounded text-[14px] font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <span>时间线</span>
          <span className="text-[12px] font-mono font-medium text-muted-foreground tabular-nums">
            ({events.length})
          </span>
          {expanded ? (
            <ChevronUp
              size={14}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <ChevronDown
              size={14}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </button>

        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onCreateEvent}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[13px] font-semibold text-primary hover:bg-[var(--surface-active)] transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus size={14} aria-hidden="true" />
          <span>新增</span>
        </button>
      </div>

      {expanded && (
        <div className="mt-3">
          {events.length === 0 ? (
            <div className="py-2 space-y-2">
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                暂无时间线事件，可点击右上角「新增」统一录入出生、求学、任职、婚姻、迁居或卒葬等生平事件。
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="group py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-2.5"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Left Time Column */}
                    <div className="w-[72px] shrink-0 pt-0.5">
                      <div className="text-[13px] font-semibold text-foreground tabular-nums leading-snug break-words">
                        {ev.yearLabel}
                      </div>
                      {ev.ageLabel && (
                        <div className="text-[12px] text-muted-foreground tabular-nums mt-0.5">
                          {ev.ageLabel}
                        </div>
                      )}
                    </div>

                    {/* Event Details Column */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-[14px] font-semibold text-foreground leading-snug">
                        {ev.title}
                      </div>

                      {ev.relatedPerson && (
                        <div>
                          {ev.relatedPerson.personId && onSelectPerson ? (
                            <button
                              type="button"
                              onClick={() =>
                                onSelectPerson(ev.relatedPerson!.personId!)
                              }
                              className="inline-flex items-center gap-2 py-0.5 text-[13px] font-medium text-primary hover:underline underline-offset-2 cursor-pointer"
                            >
                              <PersonAvatarPortrait
                                avatarUrl={ev.relatedPerson.avatarUrl}
                                displayName={ev.relatedPerson.displayName}
                                gender={ev.relatedPerson.gender}
                                sizeClass="w-6 h-6"
                                textClass="text-[12px]"
                              />
                              <span className="truncate">
                                {ev.relatedPerson.displayName}
                              </span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-2 py-0.5 text-[13px] font-medium text-foreground">
                              <PersonAvatarPortrait
                                avatarUrl={ev.relatedPerson.avatarUrl}
                                displayName={ev.relatedPerson.displayName}
                                gender={ev.relatedPerson.gender}
                                sizeClass="w-6 h-6"
                                textClass="text-[12px]"
                              />
                              <span className="truncate">
                                {ev.relatedPerson.displayName}
                              </span>
                            </span>
                          )}
                        </div>
                      )}

                      {ev.detailText && (
                        <div className="text-[13px] text-foreground leading-relaxed">
                          {ev.detailText}
                        </div>
                      )}

                      {ev.dateText && (
                        <div className="text-[12px] text-muted-foreground tabular-nums">
                          {ev.dateText}
                        </div>
                      )}

                      {ev.placeText && (
                        <div className="text-[12px] text-muted-foreground">
                          {ev.placeText}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Unified Event Edit Icon Button */}
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => onEditEvent(ev)}
                    title={`编辑${ev.title}事件`}
                    aria-label={`编辑${ev.title}事件`}
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-muted-foreground hover:bg-[var(--surface-active)] hover:text-primary transition-colors cursor-pointer"
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
