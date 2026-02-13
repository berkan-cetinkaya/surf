import { NewsItem } from '../domain/news.js';

// Simulation of a database repository
const newsRepo = [
  new NewsItem(1, 'SURF Framework Released', 'Tech', '2 min ago'),
  new NewsItem(2, 'Server-Driven UI is the Future', 'Opinion', '5 min ago'),
  new NewsItem(3, 'HTML-First Development Gains Momentum', 'Tech', '12 min ago'),
  new NewsItem(4, 'Frontend Complexity Reaches New Heights', 'Analysis', '18 min ago'),
  new NewsItem(5, 'The Rise of Progressive Enhancement', 'Tutorial', '25 min ago'),
];

export class NewsUseCase {
  getFeed() {
    // Simulate live updates logic
    const randomIndex = Math.floor(Math.random() * newsRepo.length);
    const times = ['just now', '1 min ago', '2 min ago', '5 min ago', '10 min ago'];
    newsRepo[randomIndex].time = times[Math.floor(Math.random() * times.length)];

    const hasBreaking = Math.random() > 0.7;

    return {
      items: newsRepo,
      hasBreaking,
      lastUpdated: new Date().toLocaleTimeString(),
    };
  }

  toggleReadStatus(_id) {
    // In a real app, this would toggle state in DB
    // For simulation, we return true to indicate success
    // The client-side state is persisted via local storage usually,
    // or we could track it here if we had user sessions.
    // For the demo "Echo Rule", client state is paramount.
    return true;
  }
}
