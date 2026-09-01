
/* =========================================================
   SUPABASE
========================================================= */

const supabaseClient =
    window.supabase.createClient(
        "https://fqsigukfusoplfzvevlz.supabase.co",
        "sb_publishable_S_o8arC97cbzU9F_pUIDOw_7FW-Y_Rz"
    );


/* =========================================================
   LOGIN
========================================================= */

document
    .getElementById("loginForm")
    .addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const email =
                document
                    .getElementById("email")
                    .value
                    .trim();


            const password =
                document
                    .getElementById("password")
                    .value;


            const message =
                document
                    .getElementById(
                        "loginMessage"
                    );


            message.textContent =
                "Logging in...";


            const {
                data,
                error
            } =
                await supabaseClient.auth
                    .signInWithPassword({

                        email:
                            email,

                        password:
                            password

                    });


            if (error) {

                console.error(
                    "Login failed:",
                    error
                );


                message.textContent =
                    error.message;


                return;

            }


            console.log(
                "Login successful:",
                data.user
            );


            message.textContent =
                "Login successful. Loading...";


            /*
                Supabase has created the
                authenticated session.

                Send the user to the
                main expense application.
            */

            window.location.href =
                "expensesss.html";

        }
    );
