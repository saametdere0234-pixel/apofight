# **App Name**: Apo54 Battleground

## Core Features:

- Player Account & Medal Progression: Persistently stores and updates player medal counts in real-time using Firebase.
- Pre-Game Customization: Allows players to select their character color, weapon class (Sword, Dagger, or Bow), and set their display name before entering the lobby.
- Dynamic Player Name Generator: An AI-powered tool that automatically suggests fun, unique player names if a custom name is not provided.
- Real-time Lobby System: Enables players to create new game rooms or join existing ones from a live-updating list, facilitating multiplayer matchmaking.
- Arena Combat Engine: Manages core gameplay mechanics in a 30x30m arena, including top-down player movement, dash ability, HP tracking, and real-time interaction via Socket.io.
- Weapon System Implementation: Implements unique stats, range, damage, and cooldowns for Sword, Dagger, and Bow weapon types, affecting combat precision and strategy.
- Match & Round Progression: Tracks round wins in a 'Best of 3' format, declares match winners, and updates global player medal counts based on match outcomes.

## Style Guidelines:

- Primary color: A deep, energetic blue (#2B72EE), conveying a sense of modern, futuristic combat.
- Background color: A dark, desaturated blue (#1F252E), providing a subdued backdrop that highlights interactive elements and game action.
- Accent color: A vibrant light cyan (#7ED7EB), used for crucial UI elements, interactive states, and special effects to ensure high visibility against the dark background.
- Headline font: 'Space Grotesk' (sans-serif) for a modern, tech-inspired title and primary headings. Body font: 'Inter' (sans-serif) for clear and legible text in menus and in-game information.
- Utilize minimalist, stylized icons for weapon types, abilities, and navigation, fitting the futuristic arena theme.
- A clean, functional layout prioritizing real-time game feedback. The main arena view should be central, flanked by clear, unobtrusive UI panels for player stats and actions.
- Implement subtle yet impactful animations for abilities (e.g., Dash), weapon swings, damage indicators, and menu transitions to enhance player immersion and responsiveness.