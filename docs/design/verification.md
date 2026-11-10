# Design preview verification

Verified November 9, 2026. This is visual artifact QA, not application testing.

- All 35 current default screens were opened in the browser and captured in Light and Dark (70 refreshed screenshots); no whole-page overflow was detected.
- The original 101 additional named state variants rendered with nonempty content and no whole-page horizontal overflow at the default 1280px review viewport.
- The original 32 default screens were checked at a 390px iframe viewport; no whole-page or dialog horizontal overflow was detected. Tables/boards may scroll inside their own containers.
- Browser console inspection reported no warnings/errors during the state sweep.
- Main layouts, item detail, sprint closure and dark mobile closure were visually inspected. The gallery supports Next/Previous, state selection, Light/Dark/System, ten accents, and viewport presets.
- Each screen folder contains `preview-light.jpg` and `preview-dark.jpg`, captured from the rendered standalone preview. Regenerate affected screenshots after a design change.

The retained JSON files in `review-captures` record layout/state checks. These checks establish renderability, not complete accessibility compliance or working backend flows. Keyboard/assistive technology, 320px and zoom checks remain implementation acceptance tasks unless separately reviewed.

## Action color contrast

Computed using sRGB relative luminance. Light actions use white text; dark actions use `#0e121b` text. All pairs exceed 4.5:1.

| Accent | Light ratio | Dark ratio |
| --- | --- | --- |
| Blue | 6.70:1 | 7.37:1 |
| Indigo | 7.90:1 | 9.40:1 |
| Purple | 6.98:1 | 7.09:1 |
| Pink | 6.04:1 | 10.33:1 |
| Red | 6.47:1 | 9.87:1 |
| Orange | 5.18:1 | 11.11:1 |
| Amber | 7.09:1 | 12.99:1 |
| Green | 5.02:1 | 13.34:1 |
| Teal | 5.47:1 | 12.66:1 |
| Slate | 7.58:1 | 12.62:1 |

## Shared foreground and boundary checks

| Pair | Ratio |
| --- | --- |
| Light body | 15.18:1 |
| Light secondary | 6.21:1 |
| Dark body | 15.19:1 |
| Dark secondary | 7.19:1 |
| Light control boundary | 4.69:1 |
| Dark control boundary | 5.28:1 |

Contrast calculations do not cover every transient hover/disabled state. The implementation must check the actual composited surface, focus ring and text in all combinations, including accessible field errors and popover states.

## Preview limitations

- No REST/MCP calls, persistent product data, actual credentials or actual grant changes.
- Some contextual controls demonstrate the design with a notice or fixture navigation. Their complete production behavior is specified in each `design.md`, `components.md` and the implementation plan.
- A state selector can show a scenario without simulating every event that would produce it.
- The local preview server is a convenience; the files remain usable offline in a browser even after that server stops.


## Dependency requirement update

- Checked all 35 current default screens in Light/Dark and refreshed all 70 captures.
- Checked all 60 nondefault variants of the 11 affected/new screens in Dark; none had missing content or whole-page horizontal overflow. No browser warning/error was reported in this sweep.
- Checked those 11 affected/new screens at the 390px review width, including the three new dependency dialogs; no whole-page or dialog horizontal overflow was detected.
- Demonstrated that a zero-selection Blocked action is disabled, selecting a blocker enables it, and confirming produces Blocked with the selected dependency.
- Demonstrated Not now leaves Blocked with its banner; reloading asks again; accepting explicitly produces In progress.
- Demonstrated final-link confirmation produces Open, explanatory feedback, and no readiness prompt.
- Backend transaction/permission/race behavior remains an implementation acceptance requirement; these checks exercise the design previews only.
