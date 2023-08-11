# Extended UI

Mod for game mindustry that extend your ui with some useful things.

You can easily disable any of the following features in the settings -> extended UI if you don't like it.
Some features is disabled by default. It'll not work if u doesn't enable it first.

(if you have low fps with a large number of units, turn off health bars).

## UI

The main part of the modification. Works only on your client. Most of the features from here are enabled by default.

### Schematics table

Fast access to your schematics. Splitted into categories (first row of buttons).

Configurable — right click (double tap on mobile)

1. on label to set cathegory name.
2. on cathegory button (first row) to set their image.
3. on shematic button (all another) to set their image or shematic.
4. u can also change amount of rows/columns or change button size on mod settings.

![ucf-schematics](https://cdn.discordapp.com/attachments/606977691757051920/953003359235891263/unknown.png)![cf-schematics](https://cdn.discordapp.com/attachments/606977691757051920/953004472941027328/unknown.png)

### Units table

Displays up to 6 unit types that the best 8 team on the map has, sorted by relative value.

Also have some additional features:

1. Hover over unit sprite on table to see where's he and distance to.
2. Tap on unit sprite on table to track this type of unit.

![units-table](https://cdn.discordapp.com/attachments/606977691757051920/950541449554976788/unknown.png)

### Power bar

Shows global power status. Also makes warning about net separating

![power-bar](https://cdn.discordapp.com/attachments/606977691757051920/950107054088015952/unknown.png)
![power-warning](https://cdn.discordapp.com/attachments/606977691757051920/950106865902182480/unknown.png)

### Testing (disabled by default)

Shows buildings effectiveness for testing schemes (WIP)

![buildings-effectiveness](https://cdn.discordapp.com/attachments/606977691757051920/954434576644731000/unknown.png)

Shows which processor controls units for testing logic

![logic-line](https://cdn.discordapp.com/attachments/606977691757051920/954039066305888326/unknown.png)

### Resource rate

Shows how much resources you produce

![rate](https://cdn.discordapp.com/attachments/606977691757051920/989816706987876432/EpicPen_jJO6PgFNf1.png)

### Other

Extends min and max zoom limits

Saving schemes larger than 35x35. Works in observer mode

Mine sand and other unmineble ores

Factory progress bar

![progress-bar](https://cdn.discordapp.com/attachments/606977691757051920/951186180895023165/unknown.png)

Unit health & shield bars (takes a lot of fps)

![health-shield-bar](https://cdn.discordapp.com/attachments/606977691757051920/951889454824579092/unknown.png)

Shows additional information about enemy blocks

![enemy-resources](https://cdn.discordapp.com/attachments/606977691757051920/953751760273543238/unknown.png)
![enemy-power](https://cdn.discordapp.com/attachments/606977691757051920/953751888044625991/unknown.png)

Tracks other players cursor

![enemy-cursor](https://cdn.discordapp.com/attachments/606977691757051920/954038645420068934/unknown.png)

Better conveyor/juction pathfind

![pathfind](https://cdn.discordapp.com/attachments/606977691757051920/989817162749317130/EpicPen_DsuGQN1oXs.gif)

## Interact

An additional part of the modification. Interacts with the game's API automatically (so you **may be banned** for using them, be careful)

All interactions use a general timer, configurable in the settings (500ms by default). Values ​​below **250ms** will often lead to temporary blocking from servers, so I don't recommend it.

Completely disabled by default.

### Auto fill bildings

Automatically puts resources from your drone into buildings that:

1. Can accept them
2. Can use them (for example, generators, but not containers)

If `Allow interact with core automatically` is enabled:

1. Takes resources from cores if nearby buildings need them
2. Puts resources back to core if they don't fit

Everything is quite simple: for generators, the first suitable resource is selected (for example, coal for combustion), for turrets — best ammo, for everything else all's clear

![0ms-abuse](https://cdn.discordapp.com/attachments/606977691757051920/961997293022744616/0ms_abuse.gif "0ms abuse")
