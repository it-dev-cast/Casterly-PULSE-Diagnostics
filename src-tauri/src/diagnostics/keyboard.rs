use std::collections::HashSet;
use std::io;
use std::time::{
    Duration,
    Instant
};

use crossterm::{
    event::{
        self,
        Event,
        KeyCode
    },
    terminal::{
        enable_raw_mode,
        disable_raw_mode
    }
};

use crate::models::device::
    KeyboardTest;

pub fn run()
-> KeyboardTest
{
    println!();

    println!("======================");
    println!("KEYBOARD TEST");
    println!("======================");

    println!();

    println!(
        "Press every key once."
    );

    println!();

    println!(
        "To finish:"
    );

    println!(
        "Press Q key three times"
    );

    
    println!();

    let _ =
        enable_raw_mode();

    let mut keys =
        HashSet::<String>::new();

    let mut q_count = 0;

    let mut last_q_time:
    Option<Instant> = None;

    loop
    {
        if let Ok(true) =
            event::poll(
                Duration::from_millis(
                    100
                )
            )
        {
            if let Ok(
                Event::Key(key)
            ) = event::read()
            {
                let key_name =
                    match key.code
                {
                    KeyCode::Char(c)
                        =>
                    {
                        c.to_string()
                    }

                    KeyCode::Enter
                        =>
                    {
                        "ENTER"
                            .to_string()
                    }

                    KeyCode::Tab
                        =>
                    {
                        "TAB"
                            .to_string()
                    }

                    KeyCode::Backspace
                        =>
                    {
                        "BACKSPACE"
                            .to_string()
                    }

                    KeyCode::Esc
                        =>
                    {
                        "ESC"
                            .to_string()
                    }

                    _ =>
                    {
                        format!(
                            "{:?}",
                            key.code
                        )
                    }
                };

                if !keys.contains(
                    &key_name
                )
                {
                    println!(
                        "{}",
                        key_name
                    );

                    keys.insert(
                        key_name.clone()
                    );
                }

                if let KeyCode::Char(c) =
    key.code
{
    if c == 'q'
    {
        let now =
            Instant::now();

        if let Some(last) =
            last_q_time
        {
            if now.duration_since(last)
                > Duration::from_secs(1)
            {
                q_count = 0;
            }
        }

        q_count += 1;

        last_q_time =
            Some(now);

        println!(
            "Q Press Count: {} / 3",
            q_count
        );

        if q_count >= 3
        {
            println!();

            println!(
                "Keyboard Test Complete"
            );

            break;
        }
    }
    else
    {
        q_count = 0;

        last_q_time = None;
    }
}
else
{
    q_count = 0;

    last_q_time = None;
}
            }
        }
    }

    let _ =
        disable_raw_mode();

    println!();

    println!(
        "Unique Keys Detected: {}",
        keys.len()
    );

    println!();

    println!(
        "Did Keyboard Test Pass?"
    );

    println!(
        "1. PASS"
    );

    println!(
        "2. FAIL"
    );

    let mut choice =
        String::new();

    io::stdin()
        .read_line(
            &mut choice
        )
        .unwrap();

    let result =
        if choice.trim() == "1"
    {
        "PASS"
    }
    else
    {
        "FAIL"
    };

    KeyboardTest {

        result:
            result.to_string(),

        unique_keys:
            keys.len(),
    }
}