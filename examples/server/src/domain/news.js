export class NewsItem {
    constructor(id, title, category, time) {
        this.id = id;
        this.title = title;
        this.category = category;
        this.time = time;
        this.read = false; // Default state
    }
}
