import { Song, Playlist } from '../types';

export const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: 'p1',
    name: 'Neon Solitude',
    description: 'Immersive electronic synths, retro futuristic basslines, and late-night highway visuals.',
    coverUrl: 'https://images.unsplash.com/photo-1515462277126-270d878326e5?q=80&w=600&auto=format&fit=crop',
    genre: 'Synthwave',
    songIds: ['s1', 's2']
  },
  {
    id: 'p2',
    name: 'Timber & Twine',
    description: 'Warm acoustics, hand-selected rustic melodies, and stories told around campfires.',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop',
    genre: 'Bluegrass',
    songIds: ['s3', 's4']
  },
  {
    id: 'p3',
    name: 'Echoes of Midnight',
    description: 'Deep lofi, soft vinyl static, electric pianos, and mellow rain-streaked window tunes.',
    coverUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=600&auto=format&fit=crop',
    genre: 'Lofi Pop',
    songIds: ['s5']
  }
];

export const DEFAULT_SONGS: Song[] = [
  {
    id: 's1',
    title: 'Starry Overdrive',
    artist: 'Retro Horizon',
    album: 'Neon Grid (2025)',
    genre: 'Synthwave',
    rawLyrics: `[Intro]
(Synthesizer arpeggio rises)
Cruising at midnight, grids in motion.

[Verse 1]
Concrete canyons painted red and gold
Analog secrets waiting to be told
The digital speedometer flashes sixty-four
No rearview mirrors, just open corridor

[Chorus]
Starry overdrive, neon in our veins!
We're leaving the mainframe, breaking our chains
Hold onto the dashboard, feel the current rise
Underneath the circuits of electric skies!
Starry overdrive, we will never fade!
Lost inside the digital parade!

[Verse 2]
Static reflections on your chrome sunglasses
Another shadow flickers as the engine passes
Two point one gigawatts surging through the frame
Everything's changing, but we stay the same

[Chorus]
Starry overdrive, neon in our veins!
We're leaving the mainframe, breaking our chains
Hold onto the dashboard, feel the current rise
Underneath the circuits of electric skies!
Starry overdrive, we will never fade!
Lost inside the digital parade!

[Bridge]
(Half-tempo beat, solo synth notes)
Is it real or is it just simulated glow?
Only the processors will ever know...
Reboot, restore, let the neon flow!

[Chorus]
Starry overdrive, neon in our veins!
We're leaving the mainframe, breaking our chains
Hold onto the dashboard, feel the current rise
Underneath the circuits of electric skies!
Starry overdrive, we will never fade!
Lost inside the digital parade!

[Outro]
Synthesizer fades out...
System offline.`,
    formattedLyrics: [], // Will be parsed on load/import
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop',
    duration: '3:45',
    isFeatured: true
  },
  {
    id: 's2',
    title: 'Midnight Boulevard',
    artist: 'Cyber Runner',
    album: 'Grid City Chronicles',
    genre: 'Synthwave',
    rawLyrics: `[Verse 1]
Wandering under tritium beams
Through the alleys of discarded dreams
Memory chips containing your smile
Left in the archives a long, long while

[Chorus]
Oh, the boulevard is cold tonight
Chasing the ghosts in the halogen light
Tell me you're there on the auxiliary line
Before we dissolve into computer-designed twilight!

[Verse 2]
Copper wires humming in the rain
A chemical solution for a binary pain
I plug my mind into the main matrix bay
Hoping to find what we threw away

[Chorus]
Oh, the boulevard is cold tonight
Chasing the ghosts in the halogen light
Tell me you're there on the auxiliary line
Before we dissolve into computer-designed twilight!

[Outro]
Fading tritium beams.
Midnight boulevard... offline.`,
    formattedLyrics: [],
    youtubeUrl: '',
    coverUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop',
    duration: '4:12',
    isFeatured: false
  },
  {
    id: 's3',
    title: 'Whispers in the Pines',
    artist: 'Canyon Creek Band',
    album: 'High Lonesome Ridge',
    genre: 'Bluegrass',
    rawLyrics: `[Intro]
(Fiddle and mandolin breakdown)

[Verse 1]
I climbed the ridge of the lonesome pine
To watch the coal train crawl down the line
The cold mountain mist is settling in slow
Brushing the valley with a wintertime glow

[Chorus]
Hear the whispers in the pines, calling me home
Down to the holler where the wild briars roam
My mother. My father. The porch swing we made.
Under the hills where the white dogwoods fade.

[Verse 2]
There's an old wooden banjohanging on the wall
Dusty and quiet since the end of the fall
But when the wind blows and the chimney sparks fly
You can hear a sweet melody float to the sky

[Chorus]
Hear the whispers in the pines, calling me home
Down to the holler where the wild briars roam
My mother. My father. The porch swing we made.
Under the hills where the white dogwoods fade.

[Bridge]
Time moves like a river, deep and unkind
Washing away the sweet treasures behind
But the mountains, they stand, and the pines never lie
They sing me to sleep when the heavy clouds cry.

[Chorus]
Hear the whispers in the pines, calling me home
Down to the holler where the wild briars roam
My mother. My father. The porch swing we made.
Under the hills where the white dogwoods fade.

[Outro]
(Banjo and mandolin fading into mountain birds)
Just whispers in the pine...
In the pine...`,
    formattedLyrics: [],
    youtubeUrl: '',
    coverUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=600&auto=format&fit=crop',
    duration: '3:18',
    isFeatured: true
  },
  {
    id: 's4',
    title: 'Rust and Gold',
    artist: 'Canyon Creek Band',
    album: 'High Lonesome Ridge',
    genre: 'Bluegrass',
    rawLyrics: `[Verse 1]
An old rusting tractor sitting in the weeds
Reminds of a harvest we sowed with our deeds
The barn door is creaking in the evening gale
A half-written letter and an empty mail pail

[Chorus]
Everything beautiful turns into rust
Our ironclad promises crumble to dust
But deep in the dirt where the sunflowers bold
The earth is still spinning its green and its gold.

[Verse 2]
The well has run dry and the cattle have gone
Still I wake up early and welcome the dawn
With calloused old fingers and boots made of hide
There's a quiet devotion that lingers inside

[Chorus]
Everything beautiful turns into rust
Our ironclad promises crumble to dust
But deep in the dirt where the sunflowers bold
The earth is still spinning its green and its gold.

[Outro]
Sunflowers gold...
Sunflowers gold...`,
    formattedLyrics: [],
    youtubeUrl: '',
    coverUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=600&auto=format&fit=crop',
    duration: '3:29',
    isFeatured: false
  },
  {
    id: 's5',
    title: 'Rainy Night In Tokyo',
    artist: 'Sora & The Lo-Fi Club',
    album: 'Neon Raindrop Sessions',
    genre: 'Lofi Pop',
    rawLyrics: `[Intro]
(Record needle scratches, rain sounds, coffee shop cup clinks)

[Verse 1]
Stepping out of the train at Shibuya station
Fluorescent lights in constant vibration
An umbrella built for two that I hold alone
Scrolling through drafts on my cellular phone

[Chorus]
Oh, it's a rainy night in Tokyo, retro and sweet
Watching the puddles capture lights on the street
I'm walking in time with the lo-fi beat
Wishing you were here to make the melody complete.

[Verse 2]
Sipping on matcha in a corner cafe
Watching the salaries rush off and away
The saxophone is playing a vintage melody
Reflecting the colors of my bittersweet memory

[Chorus]
Oh, it's a rainy night in Tokyo, retro and sweet
Watching the puddles capture lights on the street
I'm walking in time with the lo-fi beat
Wishing you were here to make the melody complete.

[Outro]
(Rain intensifies, dynamic vinyl pop)
Shibuya rain...
Goodnight.`,
    formattedLyrics: [],
    youtubeUrl: '',
    coverUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?q=80&w=600&auto=format&fit=crop',
    duration: '2:54',
    isFeatured: true
  }
];
