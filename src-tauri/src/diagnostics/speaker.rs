use std::io;
use std::process::Command;

use crate::models::device::
    SpeakerTest;

pub fn run()
-> SpeakerTest
{
    println!();

    println!("======================");
    println!("SPEAKER TEST");
    println!("======================");

    println!();

    println!(
        "Please ensure volume is above 70%"
    );

    println!();

    println!(
        "Playing audio test..."
    );

    println!(
        "0-5 sec   Left Speaker"
    );

    println!(
        "5-10 sec  Right Speaker"
    );

    println!(
        "10-20 sec Stereo"
    );

    println!();

    let player =
        if command_exists("ffplay")
    {
        "ffplay"
    }
    else
    {
        "aplay"
    };

    if player == "ffplay"
    {
        let _ =
            Command::new("ffplay")
                .args([
                    "-nodisp",
                    "-autoexit",
                    "assets/speaker_test.wav"
                ])
                .status();
    }
    else
    {
        let _ =
            Command::new("aplay")
                .arg(
                    "assets/speaker_test.wav"
                )
                .status();
    }

    println!();

    println!(
        "Did Speaker Test Pass?"
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

    SpeakerTest {

        result:
            result.to_string(),
    }
}

fn command_exists(
    cmd: &str
)
-> bool
{
    Command::new(
        "which"
    )
    .arg(cmd)
    .output()
    .map(
        |o|
        o.status.success()
    )
    .unwrap_or(false)
}