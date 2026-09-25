#!/bin/sh
# Notebook UX design gate (NOTEBOOK_UX_PLAN.md §1). Every counter must read 0.
# Scope: the logged-in dashboard. Public pages (forms, booking, tracking,
# login, demo), onboarding and customer content (stage colours, form themes,
# confetti) are out of scope on purpose.
cd "$(dirname "$0")/app" || exit 1
EXCL='onboarding|routes/(book|f|t|login|register|demo|a|unsubscribe)\.|instructions|CalDav|doorboost|forms/|storyboard|DemoCelebration|welcome|email-card|pipeline-stages/colors|brand\.tsx'
blue=$(grep -rniE '#5265f3' routes components lib | grep -vE "$EXCL" | wc -l | tr -d ' ')
grad=$(grep -rnE 'bg-gradient-to|bg-linear-to|bg-clip-text' routes components | grep -vE "$EXCL" | wc -l | tr -d ' ')
frame=$(grep -rnE 'bg-\[#0f0f11\]' routes/_dashboard-layout.tsx app.css 2>/dev/null | wc -l | tr -d ' ')
echo "old blue (#5265f3) in dashboard:     $blue"
echo "gradients in dashboard:              $grad"
echo "dark frame (#0f0f11) in shell/css:   $frame"
[ "$blue" = 0 ] && [ "$grad" = 0 ] && [ "$frame" = 0 ]
