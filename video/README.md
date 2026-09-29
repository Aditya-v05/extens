# Landing page video

The demo on the landing page is edited here in [Remotion](https://www.remotion.dev) from a real screen recording of Sift on usepylon.com. The rendered files are `site/public/demo.mp4` (1600×1000) and `site/public/demo-m.mp4` (720×1280, for phones).

## The source (not committed)

`public/clean.mp4` is made from the raw screen recording (`*.mov`, kept local) with ffmpeg:

- cut to the first 26.5 s and converted to 30 fps;
- the macOS menu bar cropped off (`crop=2940:1838:0:74`);
- Chrome's "Relaunch to update" and "Ask Gemini" buttons and a personal bookmark painted over, for as long as the toolbar is visible (`drawbox`, t < 4.1 s);
- **the revealed email blurred from 11.7 s to 14.4 s** (`boxblur` over x 2226, y 1464, 300×62 in recording pixels). It first appears at about 11.77 s. This is only a safety net: the edit draws a made-up address, `dan@usepylon.example`, over it (see below).

It stays out of git because the raw clip shows that email unblurred after 14.4 s. The edit only uses 1.0–3.85 s, 4.3–14.0 s and 22.0–25.6 s, none of which shows it. Check every frame of the reveal again after any change to the cut.

## The edit (`src/Demo.tsx`)

- **Structure:** an intro card, then three clips from the recording (the icon click, the Pylon result through to the revealed contact, and Save), then a closing card.
- **Camera:** a rectangle of the recording per moment, eased between. Coordinates are recording pixels, and times are seconds of the original recording.
- **Captions:** one per moment, in their own band under the picture, so they never sit on the page's text.
- **Made-up email:** the revealed address belongs to a real person, so `FakeEmail` draws `dan@usepylon.example` over it in the panel's font and background, inside the camera's coordinate space, from 11.7 s to 14.4 s. `.example` is reserved and can never be anyone's.
- **Two compositions:** `SiftDemo` (desktop) and `SiftDemoVertical` (phones) share the timeline and differ only in framing.

## Commands

```sh
cd video
npm install
npm run studio   # preview and scrub
npm run render   # writes out/demo.mp4 and out/demo-m.mp4
```

Then re-encode for the web and copy to the site:

```sh
ffmpeg -i out/demo.mp4 -an -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart ../site/public/demo.mp4
ffmpeg -i out/demo-m.mp4 -an -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart ../site/public/demo-m.mp4
```

Remotion is free for individuals and companies of up to three people; see its license.
