import json
import os

# Load main players.json
with open(r"c:\Users\ampbo\Website\players.json", 'r', encoding='utf-8') as f:
    main_players = json.load(f)

# Load position jsons
positions = ['qb', 'rb', 'wr', 'te', 'k', 'def']
pos_data = {}
for pos in positions:
    filepath = rf"c:\Users\ampbo\Website\players file\{pos}.json"
    with open(filepath, 'r', encoding='utf-8') as f:
        pos_data[pos.upper()] = json.load(f)

# Add avgValue to main players
for player in main_players:
    pos = player['position']
    if pos in pos_data:
        # Find matching player by name
        match = next((p for p in pos_data[pos] if p['name'] == player['name']), None)
        if match:
            player['avgValue'] = match.get('avgValue', 0)
            print(f"Added avgValue {player['avgValue']} to {player['name']}")
        else:
            player['avgValue'] = 0
            print(f"No match for {player['name']}")
    else:
        player['avgValue'] = 0

# Save updated players.json
with open(r"c:\Users\ampbo\Website\players.json", 'w', encoding='utf-8') as f:
    json.dump(main_players, f, ensure_ascii=False)

print("Added avgValue to players.json")