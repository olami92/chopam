Here is a blueprint to change this web based platform into a two in one **Telegram Asynchronous and synchronous P2P Skill Gaming Platform**  
We will launch with the **Whot, classic and blitz Ludo and Draught** 

## **Executive Architecture Overview**

               `┌────────────────────────────────────────────────────────┐`  
               `│              Telegram Mini App UI (TWA)                │`  
               `│         React + HTML5 Canvas (Phaser 3 Engine)         │`  
               `└───────────────────┬────────────────────────────────────┘`  
                                   `│`  
                                   `▼`  
               `┌────────────────────────────────────────────────────────┐`  
               `│             Node.js / Express Backend API              │`  
               `│   • Matchmaker & Elo    • Turn State Manager          │`  
               `│   • Telegram Stars API  • Socket.io / REST Updates      │`  
               `└───────────────────┬────────────────────────────────────┘`  
                                   `│`  
                        `┌──────────┴──────────┐`  
                        `▼                     ▼`  
               `┌──────────────────┐  ┌──────────────────┐`  
               `│  MongoDB Database│  │ Telegram Bot API │`  
               `│  • Users         │  │ • Direct Turn DMs│`  
               `│  • Active Matches│  │ • Deep Links     │`  
               `│  • Transactions  │  │ • Group Cards    │`  
               `└──────────────────┘  └──────────────────┘`

## **Phase 1: Product Definition & Core Mechanics** 

User login: Users can sign up and login through telegram, It picks and registers the owner’s telegram username.

User kyc should be disabled for now since the web app version is not launching now.

When a user is withdrawing, all should be requested is the user bank details.

### **1\. Game Rules & Turn Architecture**

> * **Turn Limit:** 1-hour turn timer for asynchronous casual play; 45-second timer for "Fast Blitz" mode.  
> * **Match Lifecycle:**  
  1. **Initiate:** Player A creates a room and chooses the game (**Whot**, **Ludo or draught**) and stake (Free / Real).  
  2. **Invite:** Deep link generated (t.me/GameBot?start=match\_9876). Player A posts link to a DM or Group, or pair with someone in the lobby.  
  3. **Play:** Player B clicks link  Mini App opens directly to match state.  
  4. **Notify:** Player B makes a move, Bot sends Telegram notification to Player A: *"⚡ It's your turn in Whot\!"*  
  5. **Settle:** Winner declared, Payout processed, Instant "Rematch" button displayed.

### **2\. Initial Monetization & Economy**

> * **Free Tier:** 5 free matches per day.  
> * **Stake Matches:** Entry fee using **real money**. Platform takes a **10% rake** on payouts.  
> * **Cosmetics:** Custom deck themes (e.g., retro Whot cards, neon Ludo boards) and custom dice animations priced in the platform custom coins.

## **Phase 2: Tech Stack & Technical Build** 

### **1\. Technology Stack**

> * **Telegram Bridge:** @twa-dev/sdk for native Telegram UI integration (haptic feedback, user authentication, back button, theme matching).  
> * **Backend:** **Socket.io** (real-time play when both users are online) falling back to **Webhooks** (when taking asynchronous turns).  
> * **Database:** should be redesigned for the asynchronous and synchronous game logic  
> * **Payments:** Two payment gateway, 1 through paystack just as it is right now and the other through telegram stars \- when user wants to deposit, they can deposit through paystack or through telegram stars. Payout will be strictly through normal withdrawal as it is currently.

> 

## **Phase 3: Viral Loop Design & Growth Engineering** 

### **1\. The "Ego & Challenge" Share Card**

When a game ends, auto-generate a shareable canvas graphic for the winner to send to chats:  
*"🏆 I just defeated @username in Whot (210 \- 80)\! Think you can beat me?"* \[ ⚔️ Challenge Me Now \] *(Inline Link)*

### **2\. Dual-Sided Referral System**

> * Referrer gets **10 Free platform custom coins**  when a friend plays their first match.  
> * Referee gets **2 Extra Energy Hearts** upon clicking the referral link.

### **3\. Group Chat Leaderboard Bot**

Allow group admins to add the bot to their Telegram groups. Group members can run /leaderboard or /top\_players to drive active rivalries within specific communities.

