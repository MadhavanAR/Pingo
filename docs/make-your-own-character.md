# 🎨 Make your own character

Pingo can use your own character instead of the bundled boy. You need
**two images**:

| Image    | Pose                                 |
| -------- | ------------------------------------ |
| Standing | **standing**, holding a water bottle |
| Drinking | **drinking** from the bottle         |

The trick is making both look like the **same character**. Here's a copy-paste
recipe for any AI image tool (ChatGPT, Gemini, etc.).

---

## The 3 rules for results that "just work"

1. **Plain, solid background** (a flat pale blue works great) — the app cuts it
   out automatically, and a busy background will leave messy edges.
2. **Full body, with empty space around them** — head to feet, centered.
3. **Same character in both images** — generate the standing pose first, then
   make the drinking pose _in the same chat_ so the tool can match it.

---

## Step 1 — the standing pose

Paste this, replacing the **[DESCRIBE YOUR CHARACTER]** part:

> Full-body cartoon character, front view, standing and smiling.
> **[DESCRIBE YOUR CHARACTER — e.g. a young man with short black hair, round
> glasses, a navy hoodie and grey joggers, brown sneakers].**
> They are holding a reusable water bottle in one hand, down at their side.
> Clean cartoon style with bold outlines and soft shading; friendly and wholesome.
> Plain solid pale-blue background, a subtle soft shadow under the feet, the
> character centered with empty space all around. No text, no frame, no border.

Save the result somewhere handy, e.g. `standing.png`.

## Step 2 — the drinking pose (keep it in the same chat!)

Right after, with the first image still in the conversation, paste this:

> Using the previous image as the reference, keep the **exact same character** —
> same face, hairstyle, glasses, outfit, colours, art style and proportions.
> Now show them tilting their head back and **drinking from the same water
> bottle**, seen from the side. Same clean cartoon style, same plain solid
> pale-blue background, same soft shadow under the feet. Full body, centered,
> with empty space around them. No text, no frame, no border.

Save the result as e.g. `drinking.png`.

---

## Step 3 — import them into the app

1. Right-click the Pingo **tray icon** → **Change character…**
2. Under _"or bring your own"_, click **Choose image…** under **Standing pose** and
   pick `standing.png`, then do the same under **Drinking pose** with `drinking.png`.
   The app cuts out the background and shows a preview of each.
3. Click **Use these images**. Your character appears at the next reminder (or
   right-click the tray icon → **Drink now** to see it straight away).

To go back to the bundled character, open **Change character…** and tap **Boy**.

---

## Troubleshooting

- **The two poses don't match.** Regenerate the drinking pose, and add: _"match
  the reference character more closely."_ Keeping both prompts in one chat helps a
  lot.
- **Edges look messy / there's a colored halo / it looks like a rectangle.** The
  background wasn't a flat solid colour. Regenerate with a plain single-colour
  background and import it again.
- **They look cut off.** Ask for _"full body with more empty space around the
  character."_
- **Different theme?** You don't have to keep the water bottle — but the app's
  celebration shows the "drinking" pose, so having them drink _something_ in the
  second image keeps it looking right.
