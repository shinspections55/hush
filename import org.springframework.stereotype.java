import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;

@Controller
public class AccountController {
    // This acts as a fake database for this example
    private Map<String, String> userDatabase = new HashMap<>();

    @PostMapping("/signup")
    public String signUp(@RequestParam String username, @RequestParam String password) {
        userDatabase.put(username, password); // Save user
        return "redirect:/?success=registered";
    }

    @PostMapping("/login")
    public String login(@RequestParam String username, @RequestParam String password, HttpSession session) {
        if (password.equals(userDatabase.get(username))) {
            session.setAttribute("activeUser", username); // Start session
            return "redirect:/dashboard";
        }
        return "redirect:/?error=wrong_creds";
    }

    @GetMapping("/dashboard")
    public String showDashboard(HttpSession session, org.springframework.ui.Model model) {
        String username = (String) session.getAttribute("activeUser");
        if (username == null) return "redirect:/"; // Not logged in!

        model.addAttribute("name", username);
        return "dashboard"; // Shows dashboard.html
    }
}