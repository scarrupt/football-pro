export const SESSION_TYPES = [
  { id: 'dribbling',    label: 'Dribbling',      icon: '⚽', color: '#8B5CF6', category: 'technical'  },
  { id: 'passing',      label: 'Passing',         icon: '🎯', color: '#06B6D4', category: 'technical'  },
  { id: 'shooting',     label: 'Shooting',        icon: '🥅', color: '#EC4899', category: 'technical'  },
  { id: 'speed',        label: 'Speed',           icon: '⚡', color: '#F59E0B', category: 'athletic'   },
  { id: 'upper_body',   label: 'Upper Body',      icon: '💪', color: '#10B981', category: 'strength'   },
  { id: 'lower_body',   label: 'Lower Body',      icon: '🦵', color: '#3B82F6', category: 'strength'   },
  { id: 'rhythmic',     label: 'Rhythmic',        icon: '🎵', color: '#A855F7', category: 'athletic'   },
  { id: 'fifa11',       label: 'FIFA 11+',        icon: '🛡️', color: '#EF4444', category: 'prevention' },
  { id: 'match_watch',  label: 'Match Analysis',  icon: '📺', color: '#0EA5E9', category: 'tactical'   },
  { id: 'match',        label: 'Match',           icon: '🏆', color: '#F97316', category: 'match'      },
  { id: 'team_training',label: 'Team Training',   icon: '👥', color: '#14B8A6', category: 'team'       },
  { id: 'rest',         label: 'Rest Day',        icon: '😴', color: '#94A3B8', category: 'recovery'   },
];

export const TRAINING_TYPES = SESSION_TYPES.filter(
  t => !['match', 'team_training', 'rest'].includes(t.id)
);


export const MOODS = [
  { id: 1, emoji: '😴', label: 'Tired'   },
  { id: 2, emoji: '😐', label: 'Okay'    },
  { id: 3, emoji: '🙂', label: 'Good'    },
  { id: 4, emoji: '😊', label: 'Great'   },
  { id: 5, emoji: '🔥', label: 'On Fire' },
];

export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAYS_FULL  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const BADGE_DEFINITIONS = [
  { id: 'first_session', name: 'First Touch',      icon: '⚽', desc: 'Logged your first training session'  },
  { id: 'streak_3',      name: 'Hat Trick',        icon: '🎩', desc: '3 days training in a row'            },
  { id: 'streak_7',      name: 'Week Warrior',     icon: '⚡', desc: '7 days training in a row'            },
  { id: 'streak_14',     name: 'Fortnight Fire',   icon: '🔥', desc: '14 days training in a row'           },
  { id: 'sessions_10',   name: 'Double Digits',    icon: '💪', desc: 'Completed 10 training sessions'      },
  { id: 'sessions_25',   name: 'Quarter Century',  icon: '🌟', desc: 'Completed 25 training sessions'      },
  { id: 'sessions_50',   name: 'Fifty Up!',        icon: '🏅', desc: 'Completed 50 training sessions'      },
  { id: 'matches_5',     name: 'Match Day Hero',   icon: '🏆', desc: 'Played 5 matches'                    },
  { id: 'all_types',     name: 'All Rounder',      icon: '🦋', desc: 'Tried all 9 training types'          },
  { id: 'fifa11_week',   name: 'Safe Striker',     icon: '🛡️', desc: 'Did FIFA 11+ twice in one week'      },
  { id: 'perfect_week',  name: 'Perfect Week',     icon: '💎', desc: 'Trained every day Mon–Sun'           },
  { id: 'early_bird',    name: 'Early Bird',       icon: '🌅', desc: 'Logged a session before 8am'         },
];

export const MOTIVATIONAL_QUOTES = [
  "Every practice brings you one step closer to your dream! ⚽",
  "Champions aren't born, they're made — one training at a time! 🌟",
  "Your future self will thank you for training today! 💪",
  "Small steps every day lead to big goals! 🎯",
  "You have what it takes — now go show it! ⚡",
  "The best players never stop improving! 🏆",
  "Dream it. Believe it. Train for it! 🌈",
  "Every touch, every drill, every session counts! ⭐",
  "Believe in yourself as much as your team believes in you! 🤝",
  "Progress, not perfection! 💫",
];

export function getSessionType(id) {
  return SESSION_TYPES.find(t => t.id === id) || SESSION_TYPES[0];
}
