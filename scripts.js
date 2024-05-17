function submitStatements() {
    const truth1 = document.getElementById('truth1').value;
    const truth2 = document.getElementById('truth2').value;
    const lie = document.getElementById('lie').value;

    const data = {
        truths: [truth1, truth2],
        lie: lie
    };

    fetch('http://localhost:3000/submit-statements', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        alert('Statements submitted successfully!');
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('Error submitting statements');
    });
}
