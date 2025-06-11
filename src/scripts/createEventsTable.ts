import { supabase } from '../lib/supabase';

async function createEventsTable() {
  const { error } = await supabase.rpc('create_events_table', {
    sql: `
      create table events (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        description text,
        date timestamptz not null,
        location text,
        points int default 0
      );
    `
  });

  if (error) {
    console.error('Error creating events table:', error);
  } else {
    console.log('Events table created successfully!');
  }
}

createEventsTable(); 