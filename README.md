# Bin Day Checker

A small React app that shows upcoming bin collection dates for North Lanarkshire addresses. Bins due today or tomorrow are highlighted in their bin colour; the rest are greyed out with their next collection date.

It scrapes the council's bin collection pages (via [allorigins.win](https://allorigins.win), since the council site doesn't send CORS headers) and refreshes hourly so it stays correct when left open on a screen.

## Running

```sh
npm install
npm run dev      # local dev server
npm run build    # production build (output in dist/)
npm run lint     # eslint
```

## Test mode

Append `?test=true` to the URL to force every bin into the "due tomorrow" state, useful for checking the highlighted layout without waiting for a real collection day.
