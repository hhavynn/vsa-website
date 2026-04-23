export const PRESIDENTS_CONTENT_ID = 'presidents_message';

export interface PresidentsContent {
  names: string;
  role: string;
  message: string;
  photoUrl: string;
}

export const DEFAULT_PRESIDENTS_CONTENT: PresidentsContent = {
  names: 'Gracie Nguyen & Phuong Le',
  role: 'Co-Presidents | VSA at UC San Diego',
  photoUrl: '',
  message: `Hello and welcome to the VSA family! 💕

We’re Gracie and Phuong, and we’re beyond excited to serve as your Co-Presidents this year! Over the summer, our passionate cabinet has been planning a year full of fun, meaningful, and memorable events that we’re so excited to share with you.

VSA at UC San Diego isn’t just a student org, it’s a home away from home. It’s a place where strangers become close friends, and where you’ll find support, community, and endless opportunities to grow. Whether you’re here to embrace Vietnamese culture, meet new people, or just find your place on campus, VSA has something special for you.

Some of our most cherished college memories and lifelong friendships started right here. And we can’t wait for you to experience the same kind of magic.

So come hang out with us! Join our events, connect with our amazing members, and become a part of something truly meaningful. We’re so excited to meet you and welcome you into the family.

Let’s make this year one to remember, together. 🧡

With love,
Gracie & Phuong
Co-Presidents | VSA at UC San Diego`,
};

export function splitPresidentsMessage(message: string): string[] {
  return message
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
